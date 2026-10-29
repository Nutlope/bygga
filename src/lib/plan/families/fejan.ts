import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * FEJAN, read from the garden table's manual. Each of the four steel legs comes in two tubes: the short one is
 * pushed into the long one, and a plastic foot is tapped onto its end with a hammer over a piece of wood. The top
 * lies upside down on a rug, a leg stands in each corner bracket, and two Allen bolts with washers go through the
 * bracket into each leg. The folding chair comes assembled and has no manual: its guide unfolds and locks it.
 */

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

function table(s: ProductSpec): CustomParams {
  // IKEA: 50 long, 44 wide, 71 high
  const W = Math.round(s.size.w * 10) || 500, D = Math.round(s.size.d * 10) || 440, H = Math.round(s.size.h * 10) || 710;
  const A = 30; // apron under the top
  const L = 22, Ls = 19; // leg tubes
  const xl = W / 2 - 20, zl = D / 2 - 20;
  const yTop = H - 14; // legs run up into the corner brackets
  const yJoin = 170, yFoot = 14;
  const topPieces: PartPiece[] = [
    { shape: "box", size: [W, 3, D], pos: [0, A / 2 - 1.5, 0] },
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [W, A, 2], pos: [0, 0, sz * (D / 2 - 1)] })),
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [2, A, D - 4], pos: [sx * (W / 2 - 1), 0, 0] })),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz): PartPiece => ({ shape: "box", size: [40, A - 4, 40], pos: [sx * (W / 2 - 28), -2, sz * (D / 2 - 28)] }))),
  ];
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx, sz] as const));
  const parts: CustomPart[] = [{ id: "T", name: "Table top", size: [W, A, D], pos: [0, H - A / 2, 0], pieces: topPieces, material: "metal" }];
  corners.forEach(([sx, sz], i) => {
    parts.push({ id: `U${i}`, name: "Long leg tube", size: [L, yTop - yJoin, L], pos: [sx * xl, (yJoin + yTop) / 2, sz * zl], shape: "cyl", material: "metal" });
    parts.push({ id: `B${i}`, name: "Short leg tube", size: [Ls, yJoin - yFoot, Ls], pos: [sx * xl, (yJoin + yFoot) / 2, sz * zl], shape: "cyl", material: "metal" });
  });
  const upper = corners.map((_, i) => `U${i}`), lower = corners.map((_, i) => `B${i}`);
  const feet = corners.map(([sx, sz]) => [sx * xl, 0, sz * zl] as Vec3);
  // two bolts a corner, from inside the bracket out into the leg; grouped by the way they point (at most ten fixes a step)
  const dirs: Vec3[] = [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]];
  const boltPts = (d: Vec3) =>
    corners
      .filter(([sx, sz]) => (d[0] ? sx === d[0] : sz === d[2]))
      // the bolts through the two sides of a bracket sit at different heights so they pass each other in the leg
      .map(([sx, sz]) => (d[0] ? [sx * (xl - L / 2 - 4), H - 28, sz * zl] : [sx * xl, H - 16, sz * (zl - L / 2 - 4)]) as Vec3);
  const boltFix = (kind: CustomFix["kind"], o: Partial<CustomFix>) => dirs.map((d) => at(kind, boltPts(d), d, "T", undefined, o));

  const steps: CustomStep[] = [
    {
      title: "Push the two tubes of each leg together",
      detail: "The narrow end of the short tube goes into the long tube, all the way in. The holes stay at the far end of the long tube.",
      add: [...upper, ...lower],
      pose: "-y",
    },
    {
      title: "Tap a foot onto each leg",
      detail: "Stand the leg on its holed end, lay a piece of wood on the foot and tap with a hammer until it sits flat on the tube.",
      fix: [at("glide", feet, [0, 1, 0], undefined, undefined, { name: "Plastic foot", len: 14, dia: 22 })],
      tools: ["hammer"],
    },
    {
      title: "Stand the legs in the corners of the top",
      detail: "Lay the top upside down on a rug. Push the holed end of each leg down into a corner bracket so the holes line up.",
      add: ["T"],
      from: { T: [0, -300, 0] },
      warnings: ["floor"],
    },
    {
      title: "Bolt each leg to its bracket",
      detail: "Two bolts with a washer in every corner, one through each side of the bracket. Tighten them with the Allen key.",
      fix: [...boltFix("washer", { len: 1.5, dia: 14 }), ...boltFix("bolt", { len: 16, dia: 6 })],
      tools: ["allen"],
    },
    { title: "Turn the table over", detail: "Stand it on its feet. It holds up to 25 kg on top: don't sit or stand on it.", pose: "+y" },
  ];
  return { parts, steps };
}


/** The folding chair: two long tubes from the back feet into the backrest, a front frame under the seat, the seat hinged between. */
function foldingChair(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 440, H = Math.round(s.size.h * 10) || 890, D = Math.round(s.size.d * 10) || 420;
  const yS = 450, tube = 20, xs = W / 2 - tube;
  const tubeBetween = (a: [number, number], c: [number, number], x: number): PartPiece => {
    const dy = c[0] - a[0], dz = c[1] - a[1];
    return { shape: "cyl", size: [tube, Math.round(Math.hypot(dy, dz)), tube], pos: [x, (a[0] + c[0]) / 2 - H / 2, (a[1] + c[1]) / 2], rot: [Math.atan2(dz, dy), 0, 0] };
  };
  const back: [number, number][] = [[0, -D / 2 + 30], [H - 20, -D / 2 + 80]];
  const front: [number, number][] = [[0, D / 2 - 20], [yS - 30, -D / 2 + 100]];
  const pieces: PartPiece[] = [
    ...[-1, 1].map((sx) => tubeBetween(back[0], back[1], sx * xs)),
    ...[-1, 1].map((sx) => tubeBetween(front[0], front[1], sx * (xs - tube))),
    { shape: "cyl", size: [tube, 2 * (xs - tube), tube], pos: [0, 160 - H / 2, D / 2 - 20 - Math.round(((D - 120) * 160) / (yS - 30))], rot: [0, 0, Math.PI / 2] },
  ];
  const parts: CustomPart[] = [
    { id: "frame", name: "Chair frame", size: [W, H, D], pos: [0, H / 2, 0], material: "metal", pieces },
    { id: "back", name: "Backrest", size: [W - 10, 200, 20], pos: [0, H - 110, -D / 2 + 76], material: "board" },
    { id: "seat", name: "Seat", size: [W - 30, 20, D - 40], pos: [0, yS, 20], material: "board" },
  ];
  const steps: CustomStep[] = [
    { title: "Take the folded chair out of the box", detail: "It comes assembled, with nothing to screw together. Stand it on its feet, still folded.", add: ["frame", "back"], from: { frame: [0, 300, 0], back: [0, 300, 0] } },
    { title: "Unfold it and press the seat down", detail: "Pull the back and the front legs apart, then push the seat down until it lies flat and the frame locks.", add: ["seat"], from: { seat: [0, 260, -200] } },
    { title: "Check it stands steady", detail: "All four feet should touch the floor. To fold it, lift the front edge of the seat. Store it indoors over winter." },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["FEJAN"],
  recipe(s) {
    if (/fejan-table/.test(s.slug ?? "")) return table(s);
    if (/folding|fejan-chair/.test(`${s.variant} ${s.slug ?? ""}`.toLowerCase())) return foldingChair(s);
    return null;
  },
};
export default family;
